import { Request, Response, NextFunction } from "express";

import { AppError } from "../../common/errors/AppError";

export function errorHandler(

error:unknown,

req:Request,

res:Response,

next:NextFunction

){

if(error instanceof AppError){

return res.status(error.statusCode).json({

success:false,

message:error.message

});

}

const message = error instanceof Error ? error.message : "Unexpected server error";
return res.status(500).json({

success:false,

message

});

}
