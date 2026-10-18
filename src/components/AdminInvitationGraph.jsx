import React, { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import { Avatar } from "./Character";
import { fa } from "../api";

function Member({ data }) {
  return <div className={`invitation-graph-member ${data.banned ? "suspended" : ""}`} dir="rtl">
    <Handle type="target" position={Position.Top}/>
    <Avatar person={data} size={37}/><div><strong>{data.name}</strong><span dir="ltr">@{data.handle || "—"}</span><small>نسل {fa(data.level)} · {fa(data.children.length)} دعوت</small></div>
    <Handle type="source" position={Position.Bottom}/>
  </div>;
}
const nodeTypes = { member: Member };
export default function AdminInvitationGraph({ roots, onFocus }) {
  const { nodes, edges, limited } = useMemo(()=>{
    const queue=[...roots], shown=[];
    for(let i=0;i<queue.length && shown.length<200;i++) { shown.push(queue[i]);queue.push(...queue[i].children); }
    const included=new Set(shown.map(node=>node.id));
    const layout=new dagre.graphlib.Graph();layout.setGraph({rankdir:"TB",ranksep:75,nodesep:28});layout.setDefaultEdgeLabel(()=>({}));
    shown.forEach(node=>layout.setNode(node.id,{width:185,height:88}));
    const edges=shown.filter(node=>included.has(node.parentId)).map(node=>({id:node.parentId+":"+node.id,source:node.parentId,target:node.id,type:"smoothstep",style:{stroke:"#b9a2cb",strokeWidth:2}}));
    edges.forEach(edge=>layout.setEdge(edge.source,edge.target));dagre.layout(layout);
    return {nodes:shown.map(node=>({id:node.id,type:"member",data:node,position:{x:layout.node(node.id).x-92.5,y:layout.node(node.id).y-44}})),edges,limited:queue.length>shown.length};
  },[roots]);
  return <><p className="graph-instruction">نقشه رو جابه‌جا و بزرگ کن؛ روی هر نفر بزن تا شاخهٔ دعوت‌هاش رو جدا ببینی.{limited && " برای روان‌بودن، ۲۰۰ نفر از این بخش نمایش داده می‌شن."}</p>
    <div className="invitation-graph" dir="ltr" aria-label="نمودار دیداری مسیر دعوت اعضا">
      <ReactFlow key={roots.map(node=>node.id).join(":")} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={.1} maxZoom={1.7} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_,node)=>onFocus(node.id)} attributionPosition="bottom-left">
        <Background color="#dfd3e8" gap={20}/><Controls showInteractive={false}/>
      </ReactFlow>
    </div></>;
}
