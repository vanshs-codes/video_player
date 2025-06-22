The backend code for a multimedia/video player.
Overview -> users can register, sign in, upload videos and watch videos uploaded by others.

TOOLS AND TECHNOLOGIES USED:
- node.js -> for runtime enviroment.  
- express -> web framework for building applications. Makes it easier to define routes, handle requests and manage middleware.  
- MongoDB -> the choice of database here. Provides flexibility and great for nested data like watch history etc. Used MongoDB Atlas.  
- mongoose -> an ODM for defining MongoDB schemas and models.  
- multer -> used for handling multipart/form data. Processes requests and stores files in local disk storage.  
- cloudinary -> for storing files (images and videos). great because of its CDN.  
- bcrypt -> for password hashing. slow and therefore secure.  
- jsonwebtoken -> for generating bearer tokens to authenticate users.  
