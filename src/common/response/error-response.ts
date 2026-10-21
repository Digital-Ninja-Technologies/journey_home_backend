import { Response } from "express";

export const errorResponse = (

    res: Response,

    message: string,

    status = 500,

    errors?: unknown

) => {

    return res.status(status).json({

        success:false,

        message,

        errors

    });

};
