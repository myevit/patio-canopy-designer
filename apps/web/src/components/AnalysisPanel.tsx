import {
  analyzeMember,
  analyzePost,
  memberAnalysisScope,
  postAnalysisScope,
  type AnalysisSnapshot,
  type AnalyzedLoadProvenance,
  type LoadProvenance,
  type MemberAnalysisReport,
  type PostAnalysisReport,
} from "@canopy/calculations";
import { useMemo, useState } from "react";

export interface AnalysisPanelProps {
  snapshot: AnalysisSnapshot;
  onMemberAnalyzed?: (report: MemberAnalysisReport) => void;
  onPostAnalyzed?: (report: PostAnalysisReport) => void;
}

function parseOptionalNumber(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function StatusBadge({ status }: { status: string }) {
  return <span data-testid="analysis-status-badge">Status: {status}</span>;
}

function LoadProvenanceList({ entries }: { entries: AnalyzedLoadProvenance[] }) {
  if (entries.length === 0) return null;
  return (
    <ul data-testid="load-provenance-list">
      {entries.map((entry, index) => (
        <li key={index}>
          {entry.kind}: {entry.provenance.label} ({entry.provenance.source})
        </li>
      ))}
    </ul>
  );
}

export function AnalysisPanel({ snapshot, onMemberAnalyzed, onPostAnalyzed }: AnalysisPanelProps) {
  const doc = snapshot.document;

  const eligibleMembers = useMemo(
    () => doc.members.map((member) => ({ member, scope: memberAnalysisScope(doc, member.id) })).filter((e) => e.scope.supported),
    [doc],
  );
  const eligiblePosts = useMemo(
    () => doc.posts.map((post) => ({ post, scope: postAnalysisScope(doc, post.id) })).filter((e) => e.scope.supported),
    [doc],
  );

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(eligibleMembers[0]?.member.id ?? null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(eligiblePosts[0]?.post.id ?? null);

  const [uniformLoad, setUniformLoad] = useState("");
  const [elasticModulus, setElasticModulus] = useState("");
  const [momentOfInertia, setMomentOfInertia] = useState("");
  const [bearingWidth, setBearingWidth] = useState("");
  const [bearingLength, setBearingLength] = useState("");
  const [allowableBearing, setAllowableBearing] = useState("");
  const [memberReport, setMemberReport] = useState<MemberAnalysisReport | null>(null);

  const [axialLoad, setAxialLoad] = useState("");
  const [endMoment, setEndMoment] = useState("");
  const [unbracedLength, setUnbracedLength] = useState("");
  const [allowableCompression, setAllowableCompression] = useState("");
  const [allowableBending, setAllowableBending] = useState("");
  const [footingWidth, setFootingWidth] = useState("");
  const [footingLength, setFootingLength] = useState("");
  const [allowableBearingCapacity, setAllowableBearingCapacity] = useState("");
  const [postReport, setPostReport] = useState<PostAnalysisReport | null>(null);

  const [provider, setProvider] = useState("");
  const [edition, setEdition] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const jurisdiction = provider || edition || effectiveDate ? { provider, edition, effectiveDate } : undefined;

  function runMemberCheck() {
    if (!selectedMemberId) return;
    const wNPerMm = parseOptionalNumber(uniformLoad);
    const bearing =
      bearingWidth.trim() !== "" && bearingLength.trim() !== ""
        ? {
            widthMm: Number(bearingWidth),
            lengthMm: Number(bearingLength),
            allowableStressMPa: parseOptionalNumber(allowableBearing),
          }
        : undefined;
    const userEnteredLoadProvenance: LoadProvenance = { source: "user-entered", label: "User-entered uniform load" };
    const report = analyzeMember(snapshot, {
      memberId: selectedMemberId,
      loads:
        wNPerMm !== undefined
          ? [{ case: { kind: "uniform", wNPerMm }, kind: "user-defined", provenance: userEnteredLoadProvenance }]
          : [],
      elasticModulusMPa: parseOptionalNumber(elasticModulus),
      momentOfInertiaMm4: parseOptionalNumber(momentOfInertia),
      bearing,
      jurisdiction,
    });
    setMemberReport(report);
    onMemberAnalyzed?.(report);
  }

  function runPostCheck() {
    if (!selectedPostId) return;
    const footing =
      footingWidth.trim() !== "" && footingLength.trim() !== ""
        ? {
            widthMm: Number(footingWidth),
            lengthMm: Number(footingLength),
            allowableBearingCapacityKPa: parseOptionalNumber(allowableBearingCapacity),
          }
        : undefined;
    const report = analyzePost(snapshot, {
      postId: selectedPostId,
      load: {
        axialLoadN: Number(axialLoad) || 0,
        endMomentNmm: Number(endMoment) || 0,
        kind: "user-defined",
        provenance: { source: "user-entered", label: "User-entered axial load and end moment" },
      },
      unbracedLengthMm: parseOptionalNumber(unbracedLength),
      allowableCompressionStressMPa: parseOptionalNumber(allowableCompression),
      allowableBendingStressMPa: parseOptionalNumber(allowableBending),
      footing,
      jurisdiction,
    });
    setPostReport(report);
    onPostAnalyzed?.(report);
  }


  return (
    <section aria-label="Component analysis" className="analysis-panel">
      <p role="note" aria-label="Preliminary planning disclaimer" className="analysis-panel__disclaimer">
        Preliminary planning only, not a professional engineering approval. Every result below is
        engineer-review-required before construction; component screening never certifies the
        assembled structure as safe, approved, or permit ready.
      </p>

      <fieldset>
        <legend>Jurisdiction / provider metadata (optional, descriptive only - never looked up)</legend>
        <label>
          Provider/authority
          <input value={provider} onChange={(event) => setProvider(event.target.value)} />
        </label>
        <label>
          Edition
          <input value={edition} onChange={(event) => setEdition(event.target.value)} />
        </label>
        <label>
          Effective date
          <input value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Member check</legend>
        {eligibleMembers.length === 0 ? (
          <p>No member is in an explicitly supported analysis scope yet.</p>
        ) : (
          <>
            <label>
              Member
              <select value={selectedMemberId ?? ""} onChange={(event) => setSelectedMemberId(event.target.value)}>
                {eligibleMembers.map(({ member, scope }) => (
                  <option key={member.id} value={member.id}>
                    {member.id} ({scope.supported ? scope.condition : ""})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Applied uniform load (N/mm)
              <input type="number" value={uniformLoad} onChange={(event) => setUniformLoad(event.target.value)} />
            </label>
            <label>
              Elastic modulus (MPa)
              <input type="number" value={elasticModulus} onChange={(event) => setElasticModulus(event.target.value)} />
            </label>
            <label>
              Moment of inertia (mm^4)
              <input
                type="number"
                value={momentOfInertia}
                onChange={(event) => setMomentOfInertia(event.target.value)}
              />
            </label>
            <label>
              Bearing width (mm)
              <input type="number" value={bearingWidth} onChange={(event) => setBearingWidth(event.target.value)} />
            </label>
            <label>
              Bearing length (mm)
              <input type="number" value={bearingLength} onChange={(event) => setBearingLength(event.target.value)} />
            </label>
            <label>
              Allowable bearing stress (MPa)
              <input
                type="number"
                value={allowableBearing}
                onChange={(event) => setAllowableBearing(event.target.value)}
              />
            </label>
            <button type="button" onClick={runMemberCheck}>
              Run member check
            </button>
          </>
        )}

        {memberReport && (
          <div data-testid="member-analysis-report" className="analysis-report">
            <h3>Member {memberReport.memberId}</h3>
            <StatusBadge status={memberReport.status} />
            {memberReport.reason && <p>{memberReport.reason}</p>}
            {memberReport.spanMm !== undefined && (
              <p>
                Span: {memberReport.spanMm.toFixed(0)} mm ({memberReport.condition})
              </p>
            )}
            {memberReport.reactionStartN !== undefined && (
              <p>
                Reactions: {memberReport.reactionStartN.toFixed(0)} N / {(memberReport.reactionEndN ?? 0).toFixed(0)}{" "}
                N
              </p>
            )}
            {memberReport.maxMomentNmm !== undefined && <p>Max moment: {memberReport.maxMomentNmm.toFixed(0)} N·mm</p>}
            {memberReport.maxShearN !== undefined && <p>Max shear: {memberReport.maxShearN.toFixed(0)} N</p>}
            {memberReport.maxDeflectionMm !== undefined && (
              <p>Max deflection: {memberReport.maxDeflectionMm.toFixed(2)} mm</p>
            )}
            {memberReport.jurisdiction && (
              <p>
                Jurisdiction: {memberReport.jurisdiction.provider} ({memberReport.jurisdiction.edition})
              </p>
            )}
            {memberReport.loadProvenance && memberReport.loadProvenance.length > 0 && (
              <>
                <p>Load provenance:</p>
                <LoadProvenanceList entries={memberReport.loadProvenance} />
              </>
            )}
            <p role="note">Engineer-review-required before this member is finalized.</p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Post check</legend>
        {eligiblePosts.length === 0 ? (
          <p>No post is in an explicitly supported analysis scope yet.</p>
        ) : (
          <>
            <label>
              Post
              <select value={selectedPostId ?? ""} onChange={(event) => setSelectedPostId(event.target.value)}>
                {eligiblePosts.map(({ post }) => (
                  <option key={post.id} value={post.id}>
                    {post.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Axial load (N)
              <input type="number" value={axialLoad} onChange={(event) => setAxialLoad(event.target.value)} />
            </label>
            <label>
              End moment (N·mm)
              <input type="number" value={endMoment} onChange={(event) => setEndMoment(event.target.value)} />
            </label>
            <label>
              Declared unbraced length (mm)
              <input type="number" value={unbracedLength} onChange={(event) => setUnbracedLength(event.target.value)} />
            </label>
            <label>
              Allowable compression stress (MPa)
              <input
                type="number"
                value={allowableCompression}
                onChange={(event) => setAllowableCompression(event.target.value)}
              />
            </label>
            <label>
              Allowable bending stress (MPa)
              <input
                type="number"
                value={allowableBending}
                onChange={(event) => setAllowableBending(event.target.value)}
              />
            </label>
            <label>
              Footing width (mm)
              <input type="number" value={footingWidth} onChange={(event) => setFootingWidth(event.target.value)} />
            </label>
            <label>
              Footing length (mm)
              <input type="number" value={footingLength} onChange={(event) => setFootingLength(event.target.value)} />
            </label>
            <label>
              Geotechnical allowable bearing capacity (kPa)
              <input
                type="number"
                value={allowableBearingCapacity}
                onChange={(event) => setAllowableBearingCapacity(event.target.value)}
              />
            </label>
            <button type="button" onClick={runPostCheck}>
              Run post check
            </button>
          </>
        )}

        {postReport && (
          <div data-testid="post-analysis-report" className="analysis-report">
            <h3>Post {postReport.postId}</h3>
            <StatusBadge status={postReport.status} />
            {postReport.reason && <p>{postReport.reason}</p>}
            {postReport.axial?.axialStressMPa !== undefined && (
              <p>Axial stress: {postReport.axial.axialStressMPa.toFixed(2)} MPa</p>
            )}
            {postReport.axial?.bendingStressMPa !== undefined && (
              <p>Bending stress: {postReport.axial.bendingStressMPa.toFixed(2)} MPa</p>
            )}
            {postReport.axial?.interactionRatio !== undefined && (
              <p>Interaction ratio: {postReport.axial.interactionRatio.toFixed(2)}</p>
            )}
            {postReport.footing?.bearingDemandKPa !== undefined && (
              <p>Footing bearing demand: {postReport.footing.bearingDemandKPa.toFixed(2)} kPa</p>
            )}
            {postReport.jurisdiction && (
              <p>
                Jurisdiction: {postReport.jurisdiction.provider} ({postReport.jurisdiction.edition})
              </p>
            )}
            {postReport.loadProvenance && (
              <>
                <p>Load provenance:</p>
                <LoadProvenanceList entries={[postReport.loadProvenance]} />
              </>
            )}
            <p role="note">Engineer-review-required before this post/footing is finalized.</p>
          </div>
        )}
      </fieldset>
    </section>
  );
}
