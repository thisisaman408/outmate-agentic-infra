import { ENABLE_KNOWLEDGE_BASES } from "@/customization/feature-flags";
import BaseModal from "@/modals/baseModal";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { CardData } from "@/types/templates/types";
import outmateBg1 from "../../../../assets/outmate_card_bg_1.png";
import outmateBg2 from "../../../../assets/outmate_card_bg_2.png";
import outmateBg3 from "../../../../assets/outmate_card_bg_3.png";

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

  const filteredExamples = examples.filter((example) => {
    return !(!ENABLE_KNOWLEDGE_BASES && example.name?.includes("Knowledge"));
  });

  // Define the card data
  const cardData: CardData[] = [
    {
      bgImage: outmateBg1,
      bgHorizontalImage: outmateBg1,
      icon: "MessagesSquare",
      category: "prompting",
      flow: filteredExamples.find(
        (example) => example.name === "Basic Prompting",
      ),
    },
    {
      bgImage: outmateBg2,
      bgHorizontalImage: outmateBg2,
      icon: "Database",
      category: "RAG",
      flow: filteredExamples.find(
        (example) => example.name === "Vector Store RAG",
      ),
    },
    {
      bgImage: outmateBg3,
      bgHorizontalImage: outmateBg3,
      icon: "Bot",
      category: "Agents",
      flow: filteredExamples.find((example) => example.name === "Simple Agent"),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <BaseModal.Header description="Start with templates showcasing outmate's Prompting, RAG, and Agent use cases.">
        Get started
      </BaseModal.Header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
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
  );
}
