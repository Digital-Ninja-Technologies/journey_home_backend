import { Response } from "express";

export const errorResponse = (

    res: Response,

    message: string,

    status = 500,

    errors?: any

) => {

    return res.status(status).json({

        success:false,

        message,

        errors

    });

};