import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const MAX_PROOF_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
]);

export type UploadedFile = FormDataEntryValue & {
    size: number;
    type: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
};

export class ProofUploadError extends Error {
    constructor(
        message: string,
        readonly code: 'VALIDATION' | 'STORAGE'
    ) {
        super(message);
        this.name = 'ProofUploadError';
    }
}

type UploadCheckinProofInput = {
    file: UploadedFile;
    challengeId: string;
    userId: string;
    cycleNumber: number;
    requestOrigin: string;
};

function sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
        case 'image/jpeg':
        case 'image/jpg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        default:
            return 'jpg';
    }
}

function assertValidProofFile(file: UploadedFile): void {
    if (!file) {
        throw new ProofUploadError('Proof image is required', 'VALIDATION');
    }

    if (file.size <= 0) {
        throw new ProofUploadError('Proof image is empty', 'VALIDATION');
    }

    if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
        throw new ProofUploadError('Proof image must be smaller than 5MB', 'VALIDATION');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new ProofUploadError('Only JPG, PNG, and WEBP images are supported', 'VALIDATION');
    }
}

function getUploadPublicBaseUrl(requestOrigin: string): string {
    return (
        process.env.UPLOAD_PUBLIC_BASE_URL ??
        process.env.NEXT_PUBLIC_UPLOAD_PUBLIC_BASE_URL ??
        requestOrigin
    ).replace(/\/+$/, '');
}

export async function uploadCheckinProof({
    file,
    challengeId,
    userId,
    cycleNumber,
    requestOrigin,
}: UploadCheckinProofInput): Promise<string> {
    assertValidProofFile(file);

    const safeChallengeId = sanitizePathSegment(challengeId);
    const safeUserId = sanitizePathSegment(userId);
    const extension = getExtensionFromMimeType(file.type);

    const relativeDir = path.join(
        'uploads',
        'checkins',
        safeChallengeId,
        `cycle-${cycleNumber}`
    );

    const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

    try {
        await mkdir(absoluteDir, { recursive: true });

        const filename = `${safeUserId}-${Date.now()}-${randomUUID()}.${extension}`;
        const absoluteFilePath = path.join(absoluteDir, filename);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writeFile(absoluteFilePath, buffer);

        const publicPath = `/${relativeDir.replaceAll(path.sep, '/')}/${filename}`;

        const publicBaseUrl = getUploadPublicBaseUrl(requestOrigin);

        return `${publicBaseUrl}${publicPath}`;
    } catch (error) {
        console.error('[CHECKIN_UPLOAD_ERROR]', {
            challengeId,
            userId,
            cycleNumber,
            error,
        });

        throw new ProofUploadError('Could not upload proof image', 'STORAGE');
    }
}
