from .starter_projects import (
    basic_prompting_graph,
    blog_writer_graph,
    document_qa_graph,
    hyper_personalisation_graph,
    icp_scoring_graph,
    memory_chatbot_graph,
    prospect_research_graph,
    vector_store_rag_graph,
)


def get_starter_projects_graphs():
    return [
        basic_prompting_graph(),
        blog_writer_graph(),
        document_qa_graph(),
        memory_chatbot_graph(),
        vector_store_rag_graph(),
        prospect_research_graph(),
        icp_scoring_graph(),
        hyper_personalisation_graph(),
    ]


def get_starter_projects_dump():
    return [g.dump() for g in get_starter_projects_graphs()]
