import { zip, unzip } from "../src/main.js";

export async main() {

    await zip("./src", "test/_temp/src.zip");
    await unzip("test/_temp/src.zip", "test/_temp");
    
}
