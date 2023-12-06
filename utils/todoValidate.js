const validateTodo=({todoText})=>{
    return new Promise((resolve,reject)=>{
        if(todoText.length===0){
            reject("Todo Empty");
        }

        if(typeof todoText !=="string" ){
            reject("Invalid Todo Type");
        } 

        if (todoText.length < 3 || todoText.length > 100){
            reject("Length of todo text should be 3-100");
        } 

        resolve();
    });
};

module.exports={validateTodo};