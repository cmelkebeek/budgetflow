import { Copy, Download } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { toast } from '../../lib/toast';

// Affiche les codes de secours une seule fois, avec copie et téléchargement.
export function RecoveryCodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const content = `Codes de secours BudgetFlow (${new Date().toLocaleDateString('fr-FR')})\nChaque code ne fonctionne qu'une seule fois.\n\n${codes.join('\n')}\n`;

  const copy = () =>
    navigator.clipboard.writeText(content).then(
      () => toast('Codes copiés', 'success'),
      () => toast('Copie impossible ici, utilise le téléchargement'),
    );

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budgetflow-codes-de-secours.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Tes codes de secours" onClose={onClose}>
      <div className="form">
        <p className="subtitle">
          Garde-les en lieu sûr (gestionnaire de mots de passe). Chacun remplace une fois le code de l'application, si tu n'as plus
          ton téléphone. <strong>Ils ne seront plus affichés.</strong>
        </p>
        <ol className="recovery-codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <div className="row-actions">
          <button type="button" className="ghost small" onClick={copy}>
            <Copy size={14} /> Copier
          </button>
          <button type="button" className="ghost small" onClick={download}>
            <Download size={14} /> Télécharger
          </button>
        </div>
        <footer className="form-actions">
          <button type="button" className="primary" onClick={onClose}>
            J'ai sauvegardé mes codes
          </button>
        </footer>
      </div>
    </Modal>
  );
}
