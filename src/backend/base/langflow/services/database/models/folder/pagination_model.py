from fastapi_pagination import Page

from outmate.helpers.base_model import BaseModel
from outmate.services.database.models.flow.model import FlowRead
from outmate.services.database.models.folder.model import FolderRead


class FolderWithPaginatedFlows(BaseModel):
    folder: FolderRead
    flows: Page[FlowRead]
