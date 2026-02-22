import os
import shutil
from laudo_generator import generate_laudo

def test_generation():
    test_data = {
        'id_laudo': 'TEST_999',
        'data': '20/02/2026',
        'local': 'Hospital de Teste',
        'unidade': 'TI - Infraestrutura',
        'nome_analista': 'Antigravity AI',
        'cargo_analista': 'Engenheiro de Software',
        'equipamentos': [
            {
                'tasy': '12345',
                'item': 'Notebook Latitude 3420',
                'marca': 'Dell',
                'modelo': 'Latitude 3420',
                'serie': 'ABC123XYZ',
                'quantidade': '1',
                'situacao': 'Em uso'
            },
            {
                'tasy': '67890',
                'item': 'Monitor P2422H',
                'marca': 'Dell',
                'modelo': 'P2422H',
                'serie': 'DEF456UVW',
                'quantidade': '2',
                'situacao': 'Inativo'
            }
        ],
        'verificacao_url': 'Teste de Autenticidade - ID 999'
    }

    print("Iniciando teste de geração de laudo...")
    try:
        output_path, temp_dir = generate_laudo(test_data)
        print(f"Sucesso! Arquivo gerado em: {output_path}")
        
        # Copy output to current dir for easy inspection
        final_dest = os.path.join(os.getcwd(), os.path.basename(output_path))
        shutil.copy(output_path, final_dest)
        print(f"Cópia criada em: {final_dest}")
        
        # Cleanup
        # shutil.rmtree(temp_dir)
        print(f"Pasta temporária mantida para inspeção: {temp_dir}")
        
    except Exception as e:
        import traceback
        print(f"Erro no teste: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    test_generation()
