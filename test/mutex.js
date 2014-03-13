import { Mutex, Condition } from "../src/Mutex.js";

export async function main() {


    var m = new Mutex;
    
    m.lock($=> {
    
        await new Promise(resolve => setTimeout($=> resolve(), 1000));
        
        console.log("a");
    });
    
    console.log("-");
    
    m.lock($=> {
    
        console.log("b");
    });
    
    console.log("-");
}