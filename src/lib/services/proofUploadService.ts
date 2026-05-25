import {
    v2 as cloudinary,
    type UploadApiOptions,
    type UploadApiResponse,
} from 'cloudinary';

export type UploadedFile = FormDataEntryValue & {
    size: number;
    type: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
};

type UploadCheckinProofParams = {
    file: UploadedFile;
    challengeId: string;
    userId: string;
    cycleNumber: number;
};

type UploadCheckinProofResult = {
    evidenceUrl: string;
    publicId: string;
};

const MAX_PROOF_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
]);

function ensureCloudinaryConfigured() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary environment variables are not configured');
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}

function sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function validateProofFile(file: UploadedFile): string | null {
    if (file.size <= 0) {
        return 'Proof image is empty';
    }

    if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
        return 'Proof image must be smaller than 5MB';
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return 'Only JPG, PNG, and WEBP images are supported';
    }

    return null;
}

function uploadBufferToCloudinary(
    buffer: Buffer,
    options: UploadApiOptions,
): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!result) {
                    reject(new Error('Cloudinary upload returned no result'));
                    return;
                }

                resolve(result);
            },
        );

        uploadStream.end(buffer);
    });
}

export async function uploadCheckinProof({
    file,
    challengeId,
    userId,
    cycleNumber,
}: UploadCheckinProofParams): Promise<UploadCheckinProofResult> {
    ensureCloudinaryConfigured();

    const validationError = validateProofFile(file);

    if (validationError) {
        throw new Error(validationError);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeChallengeId = sanitizePathSegment(challengeId);
    const safeUserId = sanitizePathSegment(userId);

    const folder = `snap-or-slap/checkins/${safeChallengeId}/cycle-${cycleNumber}`;
    const publicId = `${safeUserId}-${Date.now()}`;

    const result = await uploadBufferToCloudinary(buffer, {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
        use_filename: false,
    });

    console.log('[CHECKIN_PROOF_UPLOAD_SUCCESS]', {
        challengeId,
        userId,
        cycleNumber,
        evidenceUrl: result.secure_url,
        publicId: result.public_id,
    });

    return {
        evidenceUrl: result.secure_url,
        publicId: result.public_id,
    };
}