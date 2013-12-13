import { zip, unzip } from "../src/main.js";

export function main() {

    return zip("./", "test/_temp/src.zip").then($=> {
    
        return unzip("test/_temp/src.zip", "test/_temp");
    });
}
