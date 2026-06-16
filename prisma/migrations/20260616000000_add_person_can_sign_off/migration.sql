-- canSignOff: grants a specific person the ability to approve/reject assets
-- in the sign-off queue, regardless of their system role.
-- Default false — admin must explicitly enable it per person (Calvin, Frankie, Tom).
ALTER TABLE "Person" ADD COLUMN "canSignOff" BOOLEAN NOT NULL DEFAULT false;
