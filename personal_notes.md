1. create a types folder in every module then create a {module}/types.ts file under it, move every types and interface definitions in that module into the file, exprt it and import where it was used

2. check through the modules, everywhere an enum is found, create an enums folder and curresponding file then move the enum there, export and import where needed

3. handle paystack error well so user get a meaningful error message instead of something generic

4. add next payment date to plan model and update it appropriately

9. make the amount for creating a plan accept 10000 as 10000 naira, then when calling paystack with the ampunt, multiply by 100 according to pystack requirements

add documentations of new endpoints to the readme following the existing format

https://checkout.paystack.com/e1k6s17s7jvzn5o