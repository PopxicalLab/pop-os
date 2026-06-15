-- Add review URL and rejection note to Asset.
-- reviewUrl: link to the actual work (Drive, Frame.io, Dropbox) so CD can view it.
-- rejectionNote: CD's feedback when sending the asset back to Revision.
ALTER TABLE "Asset" ADD COLUMN "reviewUrl"     TEXT;
ALTER TABLE "Asset" ADD COLUMN "rejectionNote" TEXT;
