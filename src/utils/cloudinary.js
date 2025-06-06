import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const unlinkFile = async (localFilePath) => {
    try {
        await fs.unlink(localFilePath);
    } catch (error) {
        console.log("file deletion from disk failed, ", error);
    }
}

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        const metadata = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: "auto"
            }
        );
        console.log("file uploaded on cloudinary ", metadata.url);
        await unlinkFile(localFilePath);
        return metadata;
    } catch (error) {
        await unlinkFile(localFilePath);
        console.log("file upload failed ", error);
        return null;
    }
}

export { uploadOnCloudinary };