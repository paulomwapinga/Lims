import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Recipe = Database['public']['Tables']['recipes']['Row'];

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setRecipe(data);
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);

      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="container">
        <div className="empty-state">
          <h2>Recipe not found</h2>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === recipe.user_id;

  return (
    <div className="container">
      <div className="recipe-detail">
        <div className="recipe-header">
          <Link to="/" className="btn btn-secondary">
            Back
          </Link>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>

        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="recipe-detail-image"
          />
        )}

        <h1>{recipe.title}</h1>
        <p className="recipe-description">{recipe.description}</p>

        <div className="recipe-info">
          <div className="info-item">
            <strong>Prep Time:</strong> {recipe.prep_time} min
          </div>
          <div className="info-item">
            <strong>Cook Time:</strong> {recipe.cook_time} min
          </div>
          <div className="info-item">
            <strong>Total Time:</strong> {recipe.prep_time + recipe.cook_time} min
          </div>
          <div className="info-item">
            <strong>Servings:</strong> {recipe.servings}
          </div>
        </div>

        <section>
          <h2>Ingredients</h2>
          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Instructions</h2>
          <ol className="instruction-list">
            {recipe.instructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
