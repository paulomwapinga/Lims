import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Recipe = Database['public']['Tables']['recipes']['Row'];

export default function HomePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut } = useAuth();

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>My Recipes</h1>
        <div className="header-actions">
          <Link to="/create" className="btn btn-primary">
            Create Recipe
          </Link>
          <button onClick={signOut} className="btn btn-secondary">
            Sign Out
          </button>
        </div>
      </header>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="empty-state">
          <h2>No recipes yet</h2>
          <p>Start by creating your first recipe</p>
          <Link to="/create" className="btn btn-primary">
            Create Recipe
          </Link>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <Link key={recipe.id} to={`/recipe/${recipe.id}`} className="recipe-card">
              {recipe.image_url && (
                <img src={recipe.image_url} alt={recipe.title} className="recipe-image" />
              )}
              <div className="recipe-content">
                <h3>{recipe.title}</h3>
                <p>{recipe.description}</p>
                <div className="recipe-meta">
                  <span>{recipe.prep_time + recipe.cook_time} min</span>
                  <span>{recipe.servings} servings</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
