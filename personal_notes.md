1. create a types folder in every module then create a {module}/types.ts file under it, move every types and interface definitions in that module into the file, exprt it and import where it was used

2. check through the modules, everywhere an enum is found, create an enums folder and curresponding file then move the enum there, export and import where needed

4. restrict paystack checkout session timeout to two days, then add a check if the latest unsuccessful payment for a plan is more than 2 days, mark the transaction as abandoned or not cmpleted and initialize a new transaction to return a fresh checkout url 

5. test payment webhook receipt from paystack
6. test recurring payment
7. test that one week payment reminder emails are sent  

Important edge case: Verification failure does not prove that a transaction failed or that the checkout URL is valid. You're deliberately choosing to reuse a young URL during a Paystack outage. That's a reasonable availability trade-off, but it cannot guarantee that the URL is still usable.

However, there's one edge case worth highlighting:

What happens if the payment is marked PENDING, but Paystack verification returns abandoned?

Your code depends on applyProviderTransaction() returning the appropriate local status.

If it returns PENDING, the old checkout can still be returned, which is fine for a recent transaction. If it returns FAILED, the function proceeds to create a new payment, even if the checkout is young.

That behaviour should be intentional and consistent with your payment status mapping.

ensure deleting a user also deletes everyhing related to them