from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import delete
from ..database import get_db
from ..models import ParkGroup, ParkGroupItem
from ..schemas_extra import ParkGroupCreate, ParkGroupOut
from ..deps import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    node_ids: Optional[List[str]] = None  # kalau None, tidak mengubah items


@router.post("", response_model=ParkGroupOut)
def create_group(
    payload: ParkGroupCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    gid = str(uuid4())
    group = ParkGroup(
        group_id=gid,
        name=payload.name,
        description=payload.description,
        created_by=user.get("username"),
    )
    db.add(group)
    for nid in payload.node_ids:
        db.add(ParkGroupItem(group_id=gid, node_id=str(nid)))
    db.commit()

    node_ids = [
        i.node_id for i in db.query(ParkGroupItem).filter_by(group_id=gid).all()
    ]
    return ParkGroupOut(
        group_id=group.group_id,
        name=group.name,
        description=group.description,
        created_by=group.created_by,
        created_at=group.created_at,
        node_ids=node_ids,
    )


@router.get("", response_model=List[ParkGroupOut])
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(ParkGroup).order_by(ParkGroup.created_at.desc()).all()
    out = []
    for g in groups:
        node_ids = [
            i.node_id
            for i in db.query(ParkGroupItem).filter_by(group_id=g.group_id).all()
        ]
        out.append(
            ParkGroupOut(
                group_id=g.group_id,
                name=g.name,
                description=g.description,
                created_by=g.created_by,
                created_at=g.created_at,
                node_ids=node_ids,
            )
        )
    return out


@router.get("/{group_id}", response_model=ParkGroupOut)
def get_group(group_id: str, db: Session = Depends(get_db)):
    g = db.query(ParkGroup).filter_by(group_id=group_id).first()
    if not g:
        raise HTTPException(404, "Group not found")
    node_ids = [
        i.node_id for i in db.query(ParkGroupItem).filter_by(group_id=g.group_id).all()
    ]
    return ParkGroupOut(
        group_id=g.group_id,
        name=g.name,
        description=g.description,
        created_by=g.created_by,
        created_at=g.created_at,
        node_ids=node_ids,
    )


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, db: Session = Depends(get_db)):
    g = db.query(ParkGroup).filter_by(group_id=group_id).first()
    if not g:
        raise HTTPException(404, "Group not found")
    db.delete(g)  # cascade ke items
    db.commit()


@router.patch("/{group_id}")
def update_group(group_id: str, payload: GroupUpdate, db: Session = Depends(get_db)):
    grp = db.query(ParkGroup).filter(ParkGroup.group_id == group_id).first()
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")

    # update field dasar
    if payload.name is not None:
        grp.name = payload.name
    if payload.description is not None:
        grp.description = payload.description

    # update items (opsional)
    if payload.node_ids is not None:
        new_set = set(payload.node_ids)
        # ambil items lama
        old_rows = (
            db.query(ParkGroupItem).filter(ParkGroupItem.group_id == group_id).all()
        )
        old_set = set(r.node_id for r in old_rows)

        to_add = new_set - old_set
        to_del = old_set - new_set

        # hapus yang tidak ada lagi
        if to_del:
            db.execute(
                delete(ParkGroupItem).where(
                    ParkGroupItem.group_id == group_id,
                    ParkGroupItem.node_id.in_(to_del),
                )
            )

        # tambah yang baru
        if to_add:
            db.add_all(
                [ParkGroupItem(group_id=group_id, node_id=nid) for nid in to_add]
            )

    db.commit()
    db.refresh(grp)

    # susun response termasuk node_ids terbaru
    items = (
        db.query(ParkGroupItem.node_id).filter(ParkGroupItem.group_id == group_id).all()
    )
    node_ids = [r[0] for r in items]

    return {
        "group_id": grp.group_id,
        "name": grp.name,
        "description": grp.description,
        "node_ids": node_ids,
        "created_at": grp.created_at,
    }
