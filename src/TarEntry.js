import { TarHeader } from "TarHeader.js";

export class TarEntry {

    constructor(name) {
    
        this.name = normalizePath(name || "");
        this.mode = 0;
        this.userID = 0;
        this.groupID = 0;
        this.size = 0;
        this.lastModified = new Date();
        this.type = "file";
        this.linkPath = "";
        this.userName = "";
        this.groupName = "";
        this.deviceMajor = 0;
        this.deviceMinor = 0;
        this.attributes = {};
    }
    
}