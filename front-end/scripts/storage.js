/**
 * Data Storage API - MEMORY ONLY STUBS
 * All modules moved to backend or managed in memory. LocalStorage persistence removed.
 */
const LexFlowStorage = {
    // ===== FIRMS =====
    getFirms: () => [],
    getFirmById: () => null,

    // ===== STUBS (To prevent errors in legacy pages) =====
    getConsultations: () => [],
    getConsultationById: () => null,
    addConsultation: (d) => d,
    updateConsultation: () => null,
    deleteConsultation: () => false,
    getChatsByConsId: () => [],
    addChatMessage: (id, m) => m,
    getLawyers: () => [],
    getLawyerById: () => null,
    updateLawyer: () => null
};

// Export for global access
window.LexFlowStorage = LexFlowStorage;
