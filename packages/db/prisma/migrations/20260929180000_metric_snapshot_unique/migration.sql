-- Collectors may re-read overlapping windows; one snapshot per resource per timestamp.
DELETE FROM "MetricSnapshot" a
USING "MetricSnapshot" b
WHERE a."resourceId" = b."resourceId"
  AND a."capturedAt" = b."capturedAt"
  AND a."id" > b."id";

-- DropIndex
DROP INDEX "MetricSnapshot_resourceId_capturedAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_resourceId_capturedAt_key" ON "MetricSnapshot"("resourceId", "capturedAt");
