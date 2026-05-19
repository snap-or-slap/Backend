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

type UploadCheckinProofInput = {
    file: File;
    challengeId: string;
    userId: string;
    cycleNumber: number;
    requestOrigin: string;
};

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

function assertValidProofFile(file: File): void {
    if (!file) {
        throw new Error('Proof image is required');
    }

    if (file.size <= 0) {
        throw new Error('Proof image is empty');
    }

    if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
        throw new Error('Proof image must be smaller than 5MB');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error('Only JPG, PNG, and WEBP images are supported');
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

    const extension = getExtensionFromMimeType(file.type);

    const relativeDir = path.join(
        'uploads',
        'checkins',
        challengeId,
        `cycle-${cycleNumber}`
    );

    const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

    await mkdir(absoluteDir, { recursive: true });

    const filename = `${userId}-${Date.now()}-${randomUUID()}.${extension}`;
    const absoluteFilePath = path.join(absoluteDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await writeFile(absoluteFilePath, buffer);

    const publicPath = `/${relativeDir.replaceAll(path.sep, '/')}/${filename}`;

    const publicBaseUrl = getUploadPublicBaseUrl(requestOrigin);

    return `${publicBaseUrl}${publicPath}`;
}