import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
} from "../controllers/video.controller.js"
import { authenticateUser } from "../middlewares/auth.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"
import { optionalAuth } from '../middlewares/optionalAuth.middleware.js';

const router = Router();

router.route("/").get(
    optionalAuth,
    getAllVideos
);

router.route("/:videoId").get(
    optionalAuth,
    getVideoById
);


// secured routes
router.route("/publish").post(
    authenticateUser,
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]),
    publishAVideo
);

router.route("/:videoId")
.delete(
    authenticateUser,
    deleteVideo
)
.patch(
    authenticateUser,
    upload.single("thumbnail"),
    updateVideo
);

router.route("/toggle/publish/:videoId").patch(
    authenticateUser,
    togglePublishStatus
);

export default router