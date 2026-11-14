1. create a types folder in every module then create a {module}/types.ts file under it, move every types and interface definitions in that module into the file, exprt it and import where it was used

2. check through the modules, everywhere an enum is found, create an enums folder and curresponding file then move the enum there, export and import where needed

4. restrict paystack checkout session timeout to two days, then add a check if the latest unsuccessful payment for a plan is more than 2 days, mark the transaction as abandoned or not cmpleted and initialize a new transaction to return a fresh checkout url 

5. test payment webhook receipt from paystack
6. test recurring payment
7. test that one week payment reminder emails are sent  