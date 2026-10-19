-- Item count is an operator choice, not a two-book business limit.
ALTER TABLE "MaterialOrderItem" DROP CONSTRAINT "MaterialOrderItem_position_check";
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_position_check" CHECK ("position" > 0);
