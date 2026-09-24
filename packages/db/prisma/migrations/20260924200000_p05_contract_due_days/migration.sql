ALTER TABLE "Order" DROP CONSTRAINT "Order_due_day_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_due_day_check" CHECK (
  ("kind" = 'CONTRACT' AND "due_day" BETWEEN 1 AND 31)
  OR ("kind" <> 'CONTRACT' AND "due_day" IN (5, 10, 15, 20, 25))
);
