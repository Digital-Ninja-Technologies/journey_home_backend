1. create a types folder in every module then create a {module}/types.ts file under it, move every types and interface definitions in that module into the file, exprt it and import where it was used

2. check through the modules, everywhere an enum is found, create an enums folder and curresponding file then move the enum there, export and import where needed

3. handle paystack error well so user get a meaningful error message instead of something generic

4. add next payment date to plan model and update it appropriately

5. implement user notification setting
Notification preferences
Payment reminders
Get a reminder a few days before a payment is due.

Deficit alerts
Get notified when a payment is missed and recorded as a deficit.

Service request updates
Updates on assignment and coordination for a requested service.

Product news & offers
Occasional updates about new packages or features.


6.implement close account "delete account"

7. add total plan to listForOwner, also add pagination and filter to it, filter by name of the covered person, date created and status

8.this is for the dashboard, create an endpoint that captures the following accross all plans that a user has
Total contributed
₦0
1 payment since Oct 2026

Active plans
0
No active plans yet

Next payment
—
Nothing due

9. make the amount for creating a plan accept 10000 as 10000 naira, then when calling paystack with the ampunt, multiply by 100 according to pystack requirements

add documentations of new endpoints to the readme following the existing format
