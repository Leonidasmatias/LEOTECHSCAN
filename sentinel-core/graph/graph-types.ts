export type SigNodeType =
  | "SITE" | "MUNICIPALITY" | "STATE" | "OPERATOR" | "TECHNOLOGY" | "PROJECT" | "COORDINATE"
  | "ALERT" | "TRUST_SCORE" | "COPERNICUS_SCENE" | "SATELLITE_VALIDATION" | "LTS" | "OPI"
  | "TCI" | "SRI" | "ORI" | "ROLLOUT_PLAN" | "SCENARIO" | "REPORT" | "EVIDENCE" | "NOTE";

export type SigRelationType =
  | "LOCATED_IN" | "BELONGS_TO_OPERATOR" | "HAS_TECHNOLOGY" | "HAS_PROJECT" | "HAS_COORDINATE"
  | "HAS_ALERT" | "HAS_TRUST_SCORE" | "HAS_SATELLITE_EVIDENCE" | "HAS_LTS" | "HAS_OPI"
  | "HAS_TCI" | "HAS_SRI" | "HAS_ORI" | "HAS_NOTE" | "NEAR_TO" | "COMPETES_WITH"
  | "PRIORITY_FOR_EXPANSION" | "VALIDATED_BY" | "INCLUDED_IN_REPORT" | "RECOMMENDED_FOR";

export type SigNode = {
  nodeId: string;
  nodeType: SigNodeType;
  label: string;
  refTable?: string;
  refId?: string | number;
  attributes?: Record<string, unknown>;
};

export type SigEdge = {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: SigRelationType;
  weight?: number;
  attributes?: Record<string, unknown>;
};

export type BuildGraphOptions = {
  limit?: number;
  reset?: boolean;
};
