import { Response } from "express";
import { ApiResponse } from "./api-response";

export const successResponse = <T>(
    res: Response,
    message: string,
    data?: T,
    status = 200,
    meta?: any
) => {

    return res.status(status).json(

        new ApiResponse(true, message, data, meta)

    );

};