import { AppError } from "./AppError";

export class ConflictError extends AppError {

    constructor(message = "Resource conflict") {

        super(message, 409);

    }

}