import BaseModal from "@/modals/baseModal";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { CardData } from "@/types/templates/types";
import outmateGtmPipeline from "../../../../assets/outmate_gtm_pipeline.svg";
import outmateGtmProspect from "../../../../assets/outmate_gtm_prospect.svg";
import outmateGtmScoring from "../../../../assets/outmate_gtm_scoring.svg";
import outmateGtmOutreach from "../../../../assets/outmate_gtm_outreach.svg";

import TemplateGetStartedCardComponent from "../TemplateGetStartedCardComponent";

interface GetStartedComponentProps {
  loading: boolean;
  onFlowCreating: (loading: boolean) => void;
}

export default function GetStartedComponent({
  loading,
  onFlowCreating,
}: GetStartedComponentProps) {
  const examples = useFlowsManagerStore((state) => state.examples);

  // Featured pipeline card — all 3 agents working together
  const pipelineCard: CardData = {
    bgImage: outmateGtmPipeline,
    bgHorizontalImage: outmateGtmPipeline,
    icon: "Rocket",
    category: "full pipeline",
    flow: examples.find(
      (example) => example.name === "GTM Command Center",
    ),
  };

  // Individual agent cards
  const cardData: CardData[] = [
    {
      bgImage: outmateGtmProspect,
      bgHorizontalImage: outmateGtmProspect,
      icon: "Search",
      category: "prospect research",
      flow: examples.find(
        (example) => example.name === "Prospect Research Agent",
      ),
    },
    {
      bgImage: outmateGtmScoring,
      bgHorizontalImage: outmateGtmScoring,
      icon: "BarChart3",
      category: "lead scoring",
      flow: examples.find(
        (example) => example.name === "ICP Scoring Agent",
      ),
    },
    {
      bgImage: outmateGtmOutreach,
      bgHorizontalImage: outmateGtmOutreach,
      icon: "Mail",
      category: "email outreach",
      flow: examples.find(
        (example) => example.name === "Hyper-Personalisation Agent",
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <BaseModal.Header description="Start with GTM-ready templates for prospect research, lead scoring, and personalized outreach.">
        Get started
      </BaseModal.Header>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Featured: GTM Command Center — full pipeline */}
        <div className="w-full">
          <TemplateGetStartedCardComponent
            {...pipelineCard}
            loading={loading}
            onFlowCreating={onFlowCreating}
          />
        </div>
        {/* Individual agents */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          {cardData.map((card, index) => (
            <TemplateGetStartedCardComponent
              key={index}
              {...card}
              loading={loading}
              onFlowCreating={onFlowCreating}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
