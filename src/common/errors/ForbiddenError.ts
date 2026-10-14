import { AppError } from "./AppError";

export class ForbiddenError extends AppError{

    constructor(message="You don't have the required permissions to perform this action"){

        super(message,403);

    }

}