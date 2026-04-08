export interface TreeNode {
  key: string;
  summary: string;
  status: string;
  type: string;
  priority: string | null;
  assignee: string | null;
}

export interface TreeEdge {
  from: string;
  to: string;
  relation: string;
}

export interface TreeResult {
  root: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  depth: number;
  truncated: boolean;
  totalNodes: number;
}
