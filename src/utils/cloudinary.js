import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        const metadata = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: "auto"
            }
        );
        console.log("file uploaded on cloudinary ", metadata.secure_url);
        return metadata;
    } catch (error) {
        console.error("file upload failed ", error);
        throw error;
    }
};

const deleteFromCloudinary = async (publicUrl, resource_type = "image") => {
    try {
        if (!publicUrl) {
            console.error("public url is required");
            return null;
        }

        // Extract the public_id from the URL
        const publicIdMatch = publicUrl.match(/\/v\d+\/(.+)\.\w+$/);
        if (!publicIdMatch || !publicIdMatch[1]) {
            console.error("unable to extract public id from url: ", publicUrl);
            return null;
        }
        const public_id = publicIdMatch[1];
        
        const result = await cloudinary.uploader.destroy(public_id, {
            resource_type: resource_type,
        });

        console.log("asset deleted successfully from cloudinary: ", result);
        return result;

    } catch (error) {
        console.error("failed to delete asset from cloudinary: ", error);
        throw error;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };