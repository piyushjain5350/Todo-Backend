const isAuth=(req,res,next)=>{
    if(req.session.isAuth){
        next();
    }else{
        console.log("Session Expired , Please Login Again!")
        return res.redirect("/login");
    }
}

module.exports={isAuth};