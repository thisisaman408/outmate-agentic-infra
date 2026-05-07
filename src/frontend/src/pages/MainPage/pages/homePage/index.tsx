import PaginatorComponent from "@/components/common/paginatorComponent";
import CardsWrapComponent from "@/components/core/cardsWrapComponent";
import { useGetFolderQuery } from "@/controllers/API/queries/folders/use-get-folder";
import { CustomBanner } from "@/customization/components/custom-banner";
import { CustomMcpServerTab } from "@/customization/components/custom-McpServerTab";
import {
    ENABLE_DATASTAX_outmate,
    ENABLE_MCP,
} from "@/customization/feature-flags";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { useFolderStore } from "@/stores/foldersStore";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ListSkeleton from "../../components/listSkeleton";
import ModalsComponent from "../../components/modalsComponent";
import WorkflowsHeader from "../../components/workflowsHeader";
import WorkflowsTable from "../../components/workflowsTable";
import WorkflowsTemplatesView from "../../components/templatesView";
import useFileDrop from "../../hooks/use-on-file-drop";

const HomePage = ({ type }: { type: "flows" | "components" | "mcp" }) => {
  const [newProjectModal, setNewProjectModal] = useState(false);
  const { folderId } = useParams();
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useCustomNavigate();

  const [flowType, setFlowType] = useState<"flows" | "components" | "mcp">(
    type,
  );
  const myCollectionId = useFolderStore((state) => state.myCollectionId);
  const folders = useFolderStore((state) => state.folders);

  useEffect(() => {
    // Only check if we have a folderId and folders have loaded
    if (folderId && folders && folders.length > 0) {
      const folderExists = folders.find((folder) => folder.id === folderId);
      if (!folderExists) {
        // Folder doesn't exist for this user, redirect to /all
        console.error("Invalid folderId, redirecting to /all");
        navigate("/all");
      }
    }
  }, [folderId, folders, navigate]);

  const { data: folderData, isLoading } = useGetFolderQuery({
    id: folderId ?? myCollectionId!,
    page: pageIndex,
    size: pageSize,
    is_component: flowType === "components",
    is_flow: flowType === "flows",
    search,
  });

  const data = {
    flows: folderData?.flows?.items ?? [],
    name: folderData?.folder?.name ?? "",
    description: folderData?.folder?.description ?? "",
    parent_id: folderData?.folder?.parent_id ?? "",
    components: folderData?.folder?.components ?? [],
    pagination: {
      page: folderData?.flows?.page ?? 1,
      size: folderData?.flows?.size ?? 12,
      total: folderData?.flows?.total ?? 0,
      pages: folderData?.flows?.pages ?? 0,
    },
  };

  const handlePageChange = useCallback((newPageIndex, newPageSize) => {
    setPageIndex(newPageIndex);
    setPageSize(newPageSize);
  }, []);

  const onSearch = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPageIndex(1);
  }, []);

  const handleFileDrop = useFileDrop(flowType);

  // If MCP feature flag is disabled and we land on mcp tab, fall back to flows.
  useEffect(() => {
    if (flowType === "mcp" && !ENABLE_MCP) {
      setFlowType("flows");
    }
  }, [flowType]);

  return (
    <CardsWrapComponent
      onFileDrop={flowType === "mcp" ? undefined : handleFileDrop}
      dragMessage={`Drop your ${flowType} here`}
    >
      <div
        className="flex h-full w-full flex-col overflow-y-auto"
        data-testid="cards-wrapper"
      >
        <div className="flex h-full w-full flex-col 3xl:container">
          {ENABLE_DATASTAX_outmate && <CustomBanner />}
          <WorkflowsHeader
            flowType={flowType}
            setFlowType={setFlowType}
            onCreateWorkflow={() => setFlowType("components")}
            setSearch={onSearch}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />
          <div className="flex flex-1 flex-col justify-start px-6 py-2">
            {isLoading ? (
              <div className="mt-4 flex flex-col gap-1">
                <ListSkeleton />
                <ListSkeleton />
              </div>
            ) : flowType === "mcp" ? (
              <CustomMcpServerTab folderName={data.name} />
            ) : flowType === "components" ? (
              <WorkflowsTemplatesView />
            ) : (
              <WorkflowsTable
                flows={data.flows}
                onCreate={() => setFlowType("components")}
              />
            )}
          </div>
          {(flowType === "flows" || flowType === "components") &&
            !isLoading &&
            data.pagination.total >= 10 && (
              <div className="flex justify-end px-6 py-4">
                <PaginatorComponent
                  pageIndex={data.pagination.page}
                  pageSize={data.pagination.size}
                  rowsCount={[12, 24, 48, 96]}
                  totalRowsCount={data.pagination.total}
                  paginate={handlePageChange}
                  pages={data.pagination.pages}
                  isComponent={flowType === "components"}
                />
              </div>
            )}
        </div>
      </div>

      <ModalsComponent
        openModal={newProjectModal}
        setOpenModal={setNewProjectModal}
        openDeleteFolderModal={false}
        setOpenDeleteFolderModal={() => {}}
        handleDeleteFolder={() => {}}
      />
    </CardsWrapComponent>
  );
};

export default HomePage;
