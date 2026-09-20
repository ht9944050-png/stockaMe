'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  supplier_phone?: string;
  user_id?: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // États de la gestion de stock
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Formulaire d'ajout
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [supplierPhone, setSupplierPhone] = useState('');

  // 1. Vérifier la session de l'utilisateur
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (session) fetchProducts(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProducts(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Charger les produits uniques de l'utilisateur connecté
  const fetchProducts = async (userId: string) => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
    setLoadingProducts(false);
  };

  // 3. Ajouter un produit lié au compte connecté
  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !sku) {
      alert('Veuillez remplir au moins le Nom et le SKU !');
      return;
    }

    let cleanPhone = supplierPhone.replace(/\s+/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '212' + cleanPhone.substring(1);
    }

    const { error } = await supabase.from('products').insert([
      {
        name,
        sku,
        quantity,
        price,
        supplier_phone: cleanPhone,
        user_id: session.user.id,
      },
    ]);

    if (error) {
      alert("Erreur lors de l'ajout : " + error.message);
    } else {
      setName('');
      setSku('');
      setQuantity(0);
      setPrice(0);
      setSupplierPhone('');
      fetchProducts(session.user.id);
    }
  };

  // 4. Ajuster la quantité (+1 / -1)
  const handleAdjustQuantity = async (id: number, currentQty: number, change: number) => {
    const newQty = currentQty + change;
    if (newQty < 0) return;

    const { error } = await supabase
      .from('products')
      .update({ quantity: newQty })
      .eq('id', id);

    if (!error) {
      setProducts(products.map((p) => (p.id === id ? { ...p, quantity: newQty } : p)));
    }
  };

  // 5. Supprimer un produit
  const handleDeleteProduct = async (id: number, productName: string) => {
    if (!confirm(`Supprimer "${productName}" de votre stock ?`)) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  // 6. Commande WhatsApp
  const handleWhatsAppOrder = (product: Product) => {
    const message = `Salam, je souhaite passer une commande de réapprovisionnement :\n\n- *Produit* : ${product.name}\n- *SKU* : ${product.sku}\n- *Stock actuel* : ${product.quantity} unité(s)\n\nMerci de me confirmer la disponibilité.`;
    const encodedMessage = encodeURIComponent(message);
    const phoneTarget = product.supplier_phone ? product.supplier_phone : '';
    window.open(`https://wa.me/${phoneTarget}?text=${encodedMessage}`, '_blank');
  };

  // 7. Déconnexion
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProducts([]);
  };

  // Filtrage des produits pour la recherche
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-semibold animate-pulse">Chargement de StockMa...</p>
      </div>
    );
  }

  // VUE 1 : LANDING PAGE (Visiteur non connecté)
  if (!session) {
    return (
      <div className="min-h-screen bg-white text-gray-900 font-sans">
        <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                S
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-gray-900">
                Stock<span className="text-green-600">Ma</span> 🇲🇦
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-green-600 transition">Fonctionnalités</a>
              <a href="#pricing" className="hover:text-green-600 transition">Tarifs</a>
            </nav>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
              >
                Se connecter / S'inscrire
              </Link>
            </div>
          </div>
        </header>

        {/* Section Hero */}
        <section className="py-20 px-6 bg-gradient-to-b from-green-50/50 to-white text-center">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-6">
              Pensé pour les PME et Commerçants au Maroc
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
              Gérez votre stock & réapprovisionnez sur <span className="text-green-600">WhatsApp</span> en 1 clic.
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Fini les cahiers et les erreurs Excel. StockMa centralise vos produits, vous alerte en cas de stock faible et génère vos commandes fournisseur instantanément.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/login"
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
              >
                Créer un compte gratuit
              </Link>
            </div>
          </div>
        </section>

        {/* Section Fonctionnalités */}
        <section id="features" className="py-16 px-6 max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tout ce dont vous avez besoin pour piloter votre magasin
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Suivi en Temps Réel</h3>
              <p className="text-gray-600 text-sm">
                Ajustez vos quantités (+1/-1) en un instant depuis votre smartphone ou votre ordinateur.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="text-3xl mb-4">💬</div>
              <h3 className="text-xl font-bold mb-2">Commandes WhatsApp</h3>
              <p className="text-gray-600 text-sm">
                Envoyez un message pré-rempli directement au numéro WhatsApp de votre fournisseur en cas de rupture.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-2">100% Sécurisé & Isolé</h3>
              <p className="text-gray-600 text-sm">
                Vos données commerciales restent strictement confidentielles et accessibles uniquement par vous.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} StockMa. Fait à Casablanca. Associé : JARVIS-H7 🤝</p>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VUE 2 : DASHBOARD PRIVÉ (Utilisateur connecté)
  // ==========================================
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord StockMa</h1>
              <p className="text-gray-500 text-sm">{session.user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
              Associé : JARVIS-H7 🤝
            </span>
            <button
              onClick={handleSignOut}
              className="bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold px-4 py-2 rounded-xl transition border border-red-200"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Formulaire d'ajout de produit */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Ajouter un produit à votre inventaire</h2>
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Nom du produit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="SKU (ex: ARG-100)"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <input
              type="number"
              placeholder="Quantité"
              value={quantity || ''}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <input
              type="number"
              placeholder="Prix (DH)"
              value={price || ''}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Tél Fournisseur (ex: 0661234567)"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
              className="p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <button
              type="submit"
              className="md:col-span-5 bg-green-600 hover:bg-green-700 text-white font-semibold p-3 rounded-lg text-sm transition shadow-sm"
            >
              Enregistrer le produit
            </button>
          </form>
        </div>

        {/* Barre de Recherche */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Rechercher un produit par nom ou SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Tableau d'affichage */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loadingProducts ? (
            <div className="p-10 text-center text-gray-500 font-medium">Chargement de votre stock...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Prix</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Tél Fournisseur</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                        Aucun produit trouvé dans votre stock.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">{product.sku}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{product.price} DH</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleAdjustQuantity(product.id, product.quantity, -1)}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-sm font-bold text-gray-900">{product.quantity}</span>
                            <button
                              onClick={() => handleAdjustQuantity(product.id, product.quantity, 1)}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">
                          {product.supplier_phone ? product.supplier_phone : 'Non renseigné'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {product.quantity === 0 ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rupture</span>
                          ) : product.quantity <= 10 ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Faible</span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">En stock</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {product.quantity <= 10 && (
                              <button
                                onClick={() => handleWhatsAppOrder(product)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition"
                              >
                                💬 Commander
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}