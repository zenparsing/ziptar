import { zip, unzip } from "../src/main.js";

zip("src/", "test/_temp/src.zip").then($=> unzip("test/_temp/src.zip", "test/_temp"));