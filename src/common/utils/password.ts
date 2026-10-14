import bcrypt from "bcryptjs";

const SALT = 10;

export async function hashPassword(password: string) {
    return bcrypt.hash(password, SALT);
}

export async function comparePassword(
    password: string,
    hashed: string
) {
    return bcrypt.compare(password, hashed);
}