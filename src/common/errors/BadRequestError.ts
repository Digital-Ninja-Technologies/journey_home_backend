import { AppError } from "./AppError";

export class BadRequestError extends AppError{

    constructor(message="Invalid data provided for the request"){

        super(message,400);

    }

}