import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const optionalAuth = asyncHandler(async (req, _, next) => {
    try {
        const bearerToken = req.header("Authorization");
        const token = req.cookies?.accessToken || (bearerToken?.startsWith("Bearer ") ? bearerToken.replace("Bearer ", "") : null);
    
        if(!token) return next();
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password - refreshToken");
    
        if(user) {
            req.user = user;
        }
    
        return next();
    } catch (error) {
        return next();
    }
});