const mongoose=require("mongoose");

const Schema=mongoose.Schema;

const todoSchema= new Schema({
    todo:{
        type:String,
        require:true,
    },
    username:{
        type:String,
        require:true,
    }
});

const todoModel=mongoose.model("todo",todoSchema);
module.exports=todoModel;