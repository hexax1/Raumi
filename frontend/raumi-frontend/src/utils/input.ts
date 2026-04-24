
export function checkEnterKey<T extends Element>(e: React.KeyboardEvent<T>, callback: () => void){
    if(e.key === "Enter")
        callback();
}