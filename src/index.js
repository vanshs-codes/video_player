import connectDB from "./db/index.js";
import { app } from "./app.js";

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`app listening on http://localhost:${process.env.PORT||8000}`);
    })
})
.catch((error) => {
    console.log("db connection failed: ", error);
});