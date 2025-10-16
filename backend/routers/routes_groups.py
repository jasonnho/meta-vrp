from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import List

from ..database import get_db
from ..models import ParkGroup, ParkGroupItem
from ..schemas_extra import ParkGroupCreate, ParkGroupOut
from ..deps import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


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
