'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

interface Product {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  supplier_phone?: string | null;
  expiration_date?: string | null;
  user_id?: string;
  created_at?: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [supplierPhone, setSupplierPhone] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  const fetchProducts = async (userId: string) => {
    setLoadingProducts(true);

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur de chargement des produits:', error.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }

    setLoadingProducts(false);
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setLoadingSession(false);

      if (currentSession) {
        await fetchProducts(currentSession.user.id);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);

      if (currentSession) {
        await fetchProducts(currentSession.user.id);
      } else {
        setProducts([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAddProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.user?.id) {
      alert('Votre session a expiré. Veuillez vous reconnecter.');
      return;
    }

    if (!name.trim() || !sku.trim()) {
      alert('Veuillez remplir au moins le nom et le SKU.');
      return;
    }

    if (quantity < 0 || price < 0) {
      alert('La quantité et le prix ne peuvent pas être négatifs.');
      return;
    }

    setSavingProduct(true);

    let cleanPhone = supplierPhone.replace(/\s+/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = `212${cleanPhone.substring(1)}`;
    }

    const productData: Record<string, string | number | null> = {
      name: name.trim(),
      sku: sku.trim(),
      quantity,
      price,
      supplier_phone: cleanPhone || null,
      user_id: session.user.id,
      expiration_date: expirationDate || null,
    };

    const { error } = await supabase.from('products').insert([productData]);

    if (error) {
      console.error(error);
      alert(`Erreur lors de l'ajout : ${error.message}`);
    } else {
      setName('');
      setSku('');
      setQuantity(0);
      setPrice(0);
      setSupplierPhone('');
      setExpirationDate('');
      await fetchProducts(session.user.id);
    }

    setSavingProduct(false);
  };

  const handleAdjustQuantity = async (
    id: number,
    currentQuantity: number,
    change: number,
  ) => {
    const newQuantity = currentQuantity + change;

    if (newQuantity < 0) return;

    const { error } = await supabase
      .from('products')
      .update({ quantity: newQuantity })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      alert(`Impossible de modifier le stock : ${error.message}`);
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === id
          ? { ...product, quantity: newQuantity }
          : product,
      ),
    );
  };

  const handleDeleteProduct = async (id: number, productName: string) => {
    if (!confirm(`Supprimer « ${productName} » de votre stock ?`)) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      alert(`Impossible de supprimer le produit : ${error.message}`);
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== id),
    );
  };

  const handleWhatsAppOrder = (product: Product) => {
    if (!product.supplier_phone) {
      alert('Aucun numéro de fournisseur n’est renseigné pour ce produit.');
      return;
    }

    const message = `Salam, je souhaite passer une commande de réapprovisionnement :\n\n- Produit : ${product.name}\n- SKU : ${product.sku}\n- Stock actuel : ${product.quantity} unité(s)\n\nMerci de me confirmer la disponibilité.`;
    const encodedMessage = encodeURIComponent(message);

    window.open(
      `https://wa.me/${product.supplier_phone}?text=${encodedMessage}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProducts([]);
  };

  const totalStockValue = useMemo(
    () => products.reduce((total, product) => total + product.price * product.quantity, 0),
    [products],
  );

  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= 10).length,
    [products],
  );

  const expiringSoonCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return products.filter((product) => {
      if (!product.expiration_date) return false;

      const expiration = new Date(product.expiration_date);
      expiration.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      return diffDays >= 0 && diffDays <= 10;
    }).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query),
    );
  }, [products, searchQuery]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (value?: string | null) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('fr-MA').format(date);
  };

  const getExpirationStatus = (value?: string | null) => {
    if (!value) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiration = new Date(value);
    expiration.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) return 'expired';
    if (diffDays <= 10) return 'soon';
    return 'ok';
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-semibold animate-pulse">
          Chargement de StockMa...
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-xl font-bold text-white shadow-md">
                S
              </div>
              <span className="text-2xl font-extrabold tracking-tight">
                Stock<span className="text-green-600">Ma</span> 🇲🇦
              </span>
            </div>

            <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
              <a href="#features" className="transition hover:text-green-600">
                Fonctionnalités
              </a>
              <a href="#pricing" className="transition hover:text-green-600">
                Tarifs
              </a>
            </nav>

            <Link
              href="/login"
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              Se connecter / S'inscrire
            </Link>
          </div>
        </header>

        <section className="bg-gradient-to-b from-green-50 to-white px-6 py-20 text-center">
          <div className="mx-auto max-w-4xl">
            <span className="mb-6 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              Pensé pour les PME et commerçants au Maroc
            </span>

            <h1 className="mb-6 text-4xl font-black leading-tight text-gray-900 md:text-6xl">
              Gérez votre stock et réapprovisionnez sur{' '}
              <span className="text-green-600">WhatsApp</span> en 1 clic.
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 md:text-xl">
              Fini les cahiers et les erreurs Excel. StockMa centralise vos produits,
              surveille les stocks faibles et facilite vos commandes fournisseur.
            </p>

            <Link
              href="/login"
              className="inline-flex rounded-xl bg-green-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-xl"
            >
              Créer un compte gratuit
            </Link>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Tout ce dont vous avez besoin pour piloter votre magasin
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
              <div className="mb-4 text-3xl">⚡</div>
              <h3 className="mb-2 text-xl font-bold">Suivi en temps réel</h3>
              <p className="text-sm text-gray-600">
                Ajustez les quantités instantanément depuis votre smartphone ou votre ordinateur.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
              <div className="mb-4 text-3xl">💬</div>
              <h3 className="mb-2 text-xl font-bold">Commandes WhatsApp</h3>
              <p className="text-sm text-gray-600">
                Préparez rapidement un message de réapprovisionnement pour votre fournisseur.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
              <div className="mb-4 text-3xl">🔒</div>
              <h3 className="mb-2 text-xl font-bold">Données isolées</h3>
              <p className="text-sm text-gray-600">
                Chaque utilisateur accède uniquement aux produits associés à son compte.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-gray-100 bg-gray-50 px-6 py-16 text-center">
          <h2 className="mb-3 text-3xl font-bold">Simple pour commencer</h2>
          <p className="mx-auto max-w-xl text-gray-600">
            Créez votre compte et commencez à organiser votre inventaire avec StockMa.
          </p>
        </section>

        <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} StockMa. Fait à Casablanca. Associé : JARVIS-H7 🤝</p>
        </footer>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-xl font-bold text-white">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tableau de bord StockMa</h1>
              <p className="text-sm text-gray-500">{session.user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">
              Associé : JARVIS-H7 🤝
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Produits</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{products.length}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Valeur du stock</p>
            <p className="mt-2 text-2xl font-black text-gray-900">
              {formatPrice(totalStockValue)} DH
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">Stock faible</p>
            <p className="mt-2 text-3xl font-black text-amber-900">{lowStockCount}</p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-700">Expiration ≤ 10 jours</p>
            <p className="mt-2 text-3xl font-black text-red-900">{expiringSoonCount}</p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Ajouter un produit à votre inventaire
          </h2>

          <form onSubmit={handleAddProduct} className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <input
              type="text"
              placeholder="Nom du produit"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500 md:col-span-2"
              required
            />

            <input
              type="text"
              placeholder="SKU (ex : ARG-100)"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500"
              required
            />

            <input
              type="number"
              min="0"
              placeholder="Quantité"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Prix (DH)"
              value={price}
              onChange={(event) => setPrice(Number(event.target.value))}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500"
            />

            <input
              type="date"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500"
              title="Date d'expiration"
            />

            <input
              type="text"
              placeholder="Tél. fournisseur"
              value={supplierPhone}
              onChange={(event) => setSupplierPhone(event.target.value)}
              className="rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-500 md:col-span-2"
            />

            <button
              type="submit"
              disabled={savingProduct}
              className="rounded-lg bg-green-600 p-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-4"
            >
              {savingProduct ? 'Enregistrement...' : 'Enregistrer le produit'}
            </button>
          </form>
        </section>

        <section className="mb-6">
          <input
            type="search"
            placeholder="🔍 Rechercher un produit par nom ou SKU..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loadingProducts ? (
            <div className="p-10 text-center font-medium text-gray-500">
              Chargement de votre stock...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-gray-500">SKU</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-gray-500">Nom</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-gray-500">Prix</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold uppercase text-gray-500">Stock</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-gray-500">Expiration</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase text-gray-500">Statut</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
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
                    filteredProducts.map((product) => {
                      const expirationStatus = getExpirationStatus(product.expiration_date);

                      return (
                        <tr key={product.id} className="transition hover:bg-gray-50">
                          <td className="px-4 py-4 font-mono text-sm text-gray-600">{product.sku}</td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                            {formatPrice(product.price)} DH
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                aria-label={`Diminuer le stock de ${product.name}`}
                                onClick={() => handleAdjustQuantity(product.id, product.quantity, -1)}
                                className="h-8 w-8 rounded bg-gray-100 font-bold text-gray-800 hover:bg-gray-200"
                              >
                                −
                              </button>

                              <span className="w-8 text-sm font-bold text-gray-900">
                                {product.quantity}
                              </span>

                              <button
                                type="button"
                                aria-label={`Augmenter le stock de ${product.name}`}
                                onClick={() => handleAdjustQuantity(product.id, product.quantity, 1)}
                                className="h-8 w-8 rounded bg-gray-100 font-bold text-gray-800 hover:bg-gray-200"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(product.expiration_date)}
                          </td>

                          <td className="px-4 py-4 text-sm">
                            {product.quantity === 0 ? (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                                Rupture
                              </span>
                            ) : product.quantity <= 10 ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                Faible
                              </span>
                            ) : expirationStatus === 'expired' ? (
                              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                                Expiré
                              </span>
                            ) : expirationStatus === 'soon' ? (
                              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                                Expire bientôt
                              </span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                                En stock
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {product.quantity <= 10 && (
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppOrder(product)}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                                >
                                  💬 Commander
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                className="text-xs font-semibold text-red-600 hover:text-red-800"
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} StockMa — Gestion de stock simplifiée.
        </footer>
      </div>
    </main>
  );
}
