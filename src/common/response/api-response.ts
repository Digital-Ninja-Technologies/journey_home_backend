export class ApiResponse<T> {
    constructor(

        public success:boolean,

        public message:string,

        public data?:T,

        public meta?:unknown

    ){}
}
